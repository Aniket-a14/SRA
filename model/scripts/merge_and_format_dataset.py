import json
import os

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_jsonl(path):
    data = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            data.append(json.loads(line))
    return data

def save_jsonl(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        for entry in data:
            f.write(json.dumps(entry) + '\n')

def main():
    raw_path = 'model/pure_raw_dataset.json'
    train_path = 'model/train.jsonl'
    test_path = 'model/test.jsonl'

    if not os.path.exists(raw_path):
        print(f"❌ Error: {raw_path} not found.")
        return

    raw_data = load_json(raw_path)
    # Create lookup map: source_file -> raw_text
    raw_map = {item['source_file']: item['raw_text'] for item in raw_data}

    def process_split(split_path, output_name):
        if not os.path.exists(split_path):
            print(f"⚠️ Warning: {split_path} not found.")
            return
            
        split_data = load_jsonl(split_path)
        formatted_data = []
        
        for item in split_data:
            source_file = item['source']
            if source_file in raw_map:
                formatted_data.append({
                    "instruction": "Convert the following raw project documentation into a structured IEEE 830-1998 compliant SRS JSON. Ensure all 7 sections (Project Title, Introduction, Overall Description, External Interface Requirements, System Features, Other Non-functional Requirements, Other Requirements) are present. Generate Mermaid diagrams where applicable for interfaces and features.",
                    "input": raw_map[source_file],
                    "output": json.dumps(item['srs_json'], indent=2)
                })
            else:
                print(f"⚠️ Warning: Raw text not found for {source_file}")

        save_jsonl(formatted_data, output_name)
        print(f"✅ Created {output_name} with {len(formatted_data)} samples.")

    process_split(train_path, 'train_sft.jsonl')
    process_split(test_path, 'test_sft.jsonl')

if __name__ == "__main__":
    main()
