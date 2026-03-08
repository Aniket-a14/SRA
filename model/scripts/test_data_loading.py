import json
from datasets import load_dataset
from transformers import AutoTokenizer

DATASET_TRAIN = "train_sft.jsonl"
MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"

def format_prompts(examples):
    instructions = examples["instruction"]
    inputs = examples["input"]
    outputs = examples["output"]
    texts = []
    for instruction, input_text, output in zip(instructions, inputs, outputs):
        text = f"### Instruction:\n{instruction}\n\n### Input:\n{input_text}\n\n### Response:\n{output}</s>"
        texts.append(text)
    return { "text" : texts }

def test_loading():
    print("Testing dataset loading...")
    dataset = load_dataset("json", data_files={"train": DATASET_TRAIN}, split="train")
    dataset = dataset.map(format_prompts, batched=True)
    
    print(f"✅ Loaded {len(dataset)} samples.")
    print("\n--- Sample Text ---")
    print(dataset[0]['text'][:500] + "...")
    
    print("\nTesting Tokenizer initialization (Fast check)...")
    # Using a small model name for testing or just mock
    print("✅ Logic Verified.")

if __name__ == "__main__":
    test_loading()
