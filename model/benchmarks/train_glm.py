"""
SRA-Pro: GLM-5-Reasoning Specialized Training Script
Optimized for: ZhipuAI GLM Architecture
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
MODEL_NAME = os.getenv("MODEL_NAME", "THUDM/glm-5-reasoning-placeholder") 
OUTPUT_DIR = "./sra_glm_output"
DATASET_TRAIN = "../train_sft.jsonl"
MAX_SEQ_LENGTH = 65536

def main():
    print(f"🧠 Specialized GLM Training for: {MODEL_NAME}")
    
    # 1. Load Dataset
    dataset = load_dataset("json", data_files={"train": DATASET_TRAIN}, split="train")

    # 2. Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    # GLM often handles padding uniquely
    tokenizer.padding_side = "left" # GLM preference

    # 3. Format using GLM-native Template
    def format_glm(examples):
        texts = []
        for inst, inp, out in zip(examples["instruction"], examples["input"], examples["output"]):
            messages = [
                {"role": "system", "content": inst},
                {"role": "user", "content": inp},
                {"role": "assistant", "content": out}
            ]
            # GLM-4/5 provides high-level apply_chat_template support
            texts.append(tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False))
        return {"text": texts}
    
    dataset = dataset.map(format_glm, batched=True)

    # 4. Quantization
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
        empty_init=False, # Optimization for GLM
    )
    model.gradient_checkpointing_enable()
    model = prepare_model_for_kbit_training(model)

    # 6. LoRA Config (GLM often uses query_key_value)
    lora_config = LoraConfig(
        r=64,
        lora_alpha=128,
        # GLM architecture modules: query_key_value, dense, etc.
        target_modules=["query_key_value", "dense", "dense_h_to_4h", "dense_4h_to_h"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    # 7. Training Arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=10,
        max_steps=100,
        learning_rate=1e-4,
        bf16=True,
        logging_steps=1,
        optim="paged_adamw_8bit",
        gradient_checkpointing=True,
        report_to="wandb",
        run_name="sra_glm_benchmark",
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
    print("✅ GLM Benchmark Training Complete.")

if __name__ == "__main__":
    main()
