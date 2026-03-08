import json
import os

def filter_dataset(file_path, max_tokens=65536):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    output_file = file_path.replace(".jsonl", "_filtered.jsonl")
    removed_count = 0
    kept_count = 0
    
    with open(file_path, 'r', encoding='utf-8') as f_in, \
         open(output_file, 'w', encoding='utf-8') as f_out:
        
        for line in f_in:
            if not line.strip():
                continue
            data = json.loads(line)
            # Heuristic: 4 chars per token
            total_chars = len(data.get('instruction', '')) + len(data.get('input', '')) + len(data.get('output', ''))
            est_tokens = total_chars / 4
            
            if est_tokens <= max_tokens:
                f_out.write(json.dumps(data) + "\n")
                kept_count += 1
            else:
                removed_count += 1

    print(f"✅ Filtering Complete: {file_path}")
    print(f"Removed ( > {max_tokens} tokens): {removed_count}")
    print(f"Kept: {kept_count}")
    print(f"New file created: {output_file}")
    
    # Proactively asking to swap files
    print("\nNext step: Move the filtered file to replace the original.")

if __name__ == "__main__":
    filter_dataset("train_sft.jsonl")
    filter_dataset("test_sft.jsonl")
