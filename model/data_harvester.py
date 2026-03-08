import os
import json
import pdfminer.high_level  # For PDFs
from bs4 import BeautifulSoup # For HTML
import mammoth # For DOCX
import logging
import platform

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Try importing pywin32 for legacy .doc/.rtf formats on Windows
try:
    if platform.system() == "Windows":
        import pythoncom
        import win32com.client
        HAS_WIN32 = True
    else:
        HAS_WIN32 = False
except ImportError:
    HAS_WIN32 = False
    logger.warning("pywin32 not installed, legacy .doc/.rtf fallback disabled.")

def harvest_req_folder(folder_path):
    """
    Scans the folder for SRS documents and extracts their raw text.
    """
    dataset = []
    if not os.path.exists(folder_path):
        logger.error(f"Folder not found: {folder_path}")
        return dataset

    logger.info(f"Scanning folder: {folder_path}")
    
    # Initialize Word COM application once to save time
    word_app = None
    if HAS_WIN32:
        try:
            pythoncom.CoInitialize()
            word_app = win32com.client.DispatchEx("Word.Application")
            word_app.Visible = False
            # Prevent alerts (like "Do you want to check for conversion?" etc)
            word_app.DisplayAlerts = False 
        except Exception as e:
            logger.error(f"Failed to initialize MS Word COM: {e}")
            word_app = None
            
    try:
        for filename in os.listdir(folder_path):
            filepath = os.path.join(folder_path, filename)
            # Must use absolute path for COM
            abs_filepath = os.path.abspath(filepath)
            content = ""
            
            if os.path.isdir(filepath):
                continue

            try:
                if filename.lower().endswith(".pdf"):
                    logger.info(f"Processing PDF: {filename}")
                    content = pdfminer.high_level.extract_text(filepath)
                
                elif filename.lower().endswith((".html", ".htm")):
                    logger.info(f"Processing HTML: {filename}")
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        soup = BeautifulSoup(f, 'html.parser')
                        for element in soup(["script", "style"]):
                            element.decompose()
                        content = soup.get_text(separator=' ')
                
                elif filename.lower().endswith(".docx"):
                    logger.info(f"Processing modern Word Document (.docx): {filename}")
                    with open(filepath, "rb") as doc_file:
                        result = mammoth.extract_raw_text(doc_file)
                        content = result.value
                
                elif filename.lower().endswith((".doc", ".rtf")):
                    if word_app:
                        logger.info(f"Processing legacy Word Document via COM: {filename}")
                        # Open document, extract text, close document
                        doc = word_app.Documents.Open(abs_filepath, ReadOnly=True, Visible=False)
                        content = doc.Content.Text
                        doc.Close(False)
                    else:
                        logger.warning(f"Cannot process {filename} without MS Word COM automation.")
                
                else:
                    logger.warning(f"Skipping unsupported file type: {filename}")
                    continue

                if content and content.strip():
                    dataset.append({
                        "source_file": filename,
                        "raw_text": content.strip()
                    })
                else:
                    logger.warning(f"No text extracted from: {filename}")

            except Exception as e:
                logger.error(f"Failed to harvest {filename}: {str(e)}")
                
    finally:
        # Ensure we quit the Word app
        if word_app:
            try:
                word_app.Quit()
            except:
                pass
            try:
                pythoncom.CoUninitialize()
            except:
                pass
                
    return dataset

def main():
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    REQ_PATH = os.path.join(PROJECT_ROOT, "model", "req")
    OUTPUT_FILE = os.path.join(PROJECT_ROOT, "model", "pure_raw_dataset.json")
    
    logger.info("🚀 Starting SRA-Pro Data Harvest...")
    data = harvest_req_folder(REQ_PATH)
    
    if data:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        logger.info(f"✨ Success! Saved {len(data)} documents to {OUTPUT_FILE}")
    else:
        logger.error("❌ Harvest failed: No data extracted.")

if __name__ == "__main__":
    main()
