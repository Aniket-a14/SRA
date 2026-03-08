"""
SRA-Pro: Qwen-3.5-397B Specialized Training Script
Optimized for: Alibaba Qwen Architecture (MoE)
"""

import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# --- CONFIGURATION ---
MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-Tail-397B") 
OUTPUT_DIR = "./sra_qwen_output"
DATASET_TRAIN = "../train_sft.jsonl"
MAX_SEQ_LENGTH = 65536 

def main():
    print(f"🏮 Specialized Qwen Training for: {MODEL_NAME}")
    
    # 1. Load Dataset
    dataset = load_dataset("json", data_files={"train": DATASET_TRAIN}, split="train")

    # 2. Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Format using Qwen-native ChatML Template
    def format_qwen(examples):
        texts = []
        for inst, inp, out in zip(examples["instruction"], examples["input"], examples["output"]):
            messages = [
                {"role": "system", "content": inst},
                {"role": "user", "content": inp},
                {"role": "assistant", "content": out}
            ]
            texts.append(tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False))
        return {"text": texts}
    
    dataset = dataset.map(format_qwen, batched=True)

    # 4. Quantization (Aggressive 4-bit for 397B model)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # 5. Load Model
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        # MoE optimization
    )
    model.gradient_checkpointing_enable()
    model = prepare_model_for_kbit_training(model)

    # 6. LoRA Config (Targeting all linear layers including experts)
    lora_config = LoraConfig(
        r=64,
        lora_alpha=128,
        # For MoE models, we often target FFN layers which include the experts
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    # 7. Training Arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=16, # High accumulation for huge model
        warmup_ratio=0.03,
        max_steps=150,
        learning_rate=2e-4,
        bf16=True,
        logging_steps=1,
        optim="paged_adamw_8bit",
        gradient_checkpointing=True,
        report_to="wandb",
        run_name="sra_qwen_benchmark",
    )

    # 8. Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        tokenizer=tokenizer,
        args=training_args,
    )

    trainer.train()
    trainer.model.save_pretrained(OUTPUT_DIR)
    print("✅ Qwen Benchmark Training Complete.")

if __name__ == "__main__":
    main()
