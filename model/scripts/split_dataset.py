import json
import random
import os

def split_dataset(input_file, train_file, test_file, test_size=9, seed=42):
    random.seed(seed)
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = [json.loads(line) for line in f]
    
    random.shuffle(lines)
    
    test_set = lines[:test_size]
    train_set = lines[test_size:]
    
    # Save training set
    with open(train_file, 'w', encoding='utf-8') as f:
        for entry in train_set:
            f.write(json.dumps(entry) + '\n')
            
    # Save test set (Blind Test)
    with open(test_file, 'w', encoding='utf-8') as f:
        for entry in test_set:
            f.write(json.dumps(entry) + '\n')
            
    print(f"📊 Split complete: {len(train_set)} training samples, {len(test_set)} test samples.")

if __name__ == "__main__":
    split_dataset('golden_training_dataset.jsonl', 'train.jsonl', 'test.jsonl')
