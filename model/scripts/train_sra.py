"""
SRA-Pro: Unified Universal Fine-Tuning Script
Supports: DeepSeek, Qwen, Llama, GLM, Kimi
Optimized for: NVIDIA Lab (Multi-GPU, DeepSpeed, QLoRA)
"""

import os
import torch
import json
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    DataCollatorForSeq2Seq,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer
import wandb

# --- CONFIGURATION ---
MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct") 
OUTPUT_DIR = "./sra_model_output"
DATASET_TRAIN = "train_sft.jsonl"
MAX_SEQ_LENGTH = 65536 # Enterprise scale

def main():
    print(f"🚀 Starting SRA Lab Training for: {MODEL_NAME}")
    
    # 1. Load Dataset
    dataset = load_dataset("json", data_files={"train": DATASET_TRAIN}, split="train")

    # 2. Tokenizer & Chat Template
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Use native chat template if available for maximum accuracy
    def format_prompts(examples):
        texts = []
        for inst, inp, out in zip(examples["instruction"], examples["input"], examples["output"]):
            messages = [
                {"role": "system", "content": inst},
                {"role": "user", "content": inp},
                {"role": "assistant", "content": out}
            ]
            try:
                # Try to use model's native template
                text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            except:
                # Fallback to SRA/Alpaca style
                text = f"### Instruction:\n{inst}\n\n### Input:\n{inp}\n\n### Response:\n{out}</s>"
            texts.append(text)
        return { "text" : texts }

    dataset = dataset.map(format_prompts, batched=True)

    # 3. Quantization Config (4-bit QLoRA)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16, # Optimized for A100/H100
        bnb_4bit_use_double_quant=True,
    )

    # 4. Load Model
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        attn_implementation="flash_attention_2", # Use Flash Attention
    )
    
    model.gradient_checkpointing_enable() # Critical for 16k context
    model = prepare_model_for_kbit_training(model)

    # 5. LoRA Config (Universal Target)
    lora_config = LoraConfig(
        r=64,
        lora_alpha=128,
        # Targeting all linear layers ensures compatibility across models
        target_modules="all-linear", 
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    # 6. Training Arguments (Lab Optimized)
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_ratio=0.03,
        max_steps=100, 
        learning_rate=2e-4,
        bf16=True, # Use BF16 for NVIDIA Labs
        logging_steps=1,
        optim="paged_adamw_32bit",
        gradient_checkpointing=True,
        report_to="wandb",
        run_name=f"sra_lab_{MODEL_NAME.split('/')[-1]}",
    )

    # 7. SFT Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        tokenizer=tokenizer,
        args=training_args,
    )

    # 8. Train
    print("💎 Training started in Lab Environment...")
    trainer.train()

    # 9. Save
    print(f"💾 Saving adapters to {OUTPUT_DIR}...")
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("✅ Lab Training Complete.")

if __name__ == "__main__":
    main()
