import os
import glob
from pdfminer.high_level import extract_text_to_fp

def convert_pdf_to_txt(directory):
    for file_path in glob.iglob(directory + '/**/*.pdf', recursive=True):
        # Generate the output file path by replacing the .pdf extension with .txt
        output_file_path = os.path.splitext(file_path)[0] + '.txt'
        
        # Extract text from the PDF and write it to the output file
        with open(file_path, 'rb') as input_file, open(output_file_path, 'w') as output_file:
            extract_text_to_fp(input_file, output_file)

# Example usage
convert_pdf_to_txt('/Users/joseanu/Desktop/manuales/axioma')