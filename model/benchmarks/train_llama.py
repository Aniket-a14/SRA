"""
SRA-Pro: Llama-4-Maverick Specialized Training Script
Optimized for: Meta-Llama architecture (Llama 3/4)
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
MODEL_NAME = os.getenv("MODEL_NAME", "meta-llama/Llama-4-Maverick") 
OUTPUT_DIR = "./sra_llama_output"
DATASET_TRAIN = "../train_sft.jsonl"
MAX_SEQ_LENGTH = 65536  # Enterprise scale (64k) for full SRS documents

def main():
    print(f"🦙 Specialized Llama Training for: {MODEL_NAME}")
    
    # 1. Load Dataset
    dataset = load_dataset("json", data_files={"train": DATASET_TRAIN}, split="train")

    # 2. Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Format using Llama-native Chat Template
    def format_llama(examples):
        texts = []
        for inst, inp, out in zip(examples["instruction"], examples["input"], examples["output"]):
            messages = [
                {"role": "system", "content": inst},
                {"role": "user", "content": inp},
                {"role": "assistant", "content": out}
            ]
            texts.append(tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False))
        return {"text": texts}
    
    dataset = dataset.map(format_llama, batched=True)

    # 4. Quantization (4-bit QLoRA)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16, # Llama prefers BF16
        bnb_4bit_use_double_quant=True,
    )

    # 5. Load Model
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        attn_implementation="flash_attention_2", # Llama-4 optimization
    )
    model.gradient_checkpointing_enable() # Save VRAM for long context
    model = prepare_model_for_kbit_training(model)

    # 6. LoRA Config (Optimized for Llama)
    lora_config = LoraConfig(
        r=128, # Higher rank for complex SRA logic
        lora_alpha=256,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.01, # Low dropout for high-reliability models
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    # 7. Training Arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=20,
        max_steps=200,
        learning_rate=1e-4, # Stable learning rate for Llama
        bf16=True, 
        logging_steps=1,
        optim="paged_adamw_32bit",
        gradient_checkpointing=True,
        report_to="wandb",
        run_name="sra_llama_benchmark",
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
    print("✅ Llama Benchmark Training Complete.")

if __name__ == "__main__":
    main()
