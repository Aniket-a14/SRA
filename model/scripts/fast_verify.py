import json
import os

def verify_dataset(path):
    print(f"Checking {path}...")
    if not os.path.exists(path):
        print(f"❌ {path} not found.")
        return False
    
    count = 0
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if all(k in data for k in ["instruction", "input", "output"]):
                    count += 1
                else:
                    print(f"⚠️ Missing keys in line {count+1}")
            except Exception as e:
                print(f"❌ Parse error in {path} at line {count+1}: {e}")
                return False
    
    print(f"✅ {path} is valid. Found {count} samples.")
    return True

if __name__ == "__main__":
    v1 = verify_dataset("train_sft.jsonl")
    v2 = verify_dataset("test_sft.jsonl")
    if v1 and v2:
        print("\n🚀 DATASET VERIFICATION SUCCESSFUL.")
