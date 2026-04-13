/**
 * Generate Super Admin Test Guide PDF
 * Converts the markdown guide to a professional PDF document
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function generatePDF() {
  const inputFile = 'docs/SUPERADMIN_TEST_GUIDE.md';
  const outputFile = 'SuperAdmin_Test_Guide.pdf';

  console.log('📄 Generating Super Admin Test Guide PDF...\n');

  // Check if pandoc is available
  try {
    await execAsync('which pandoc');
    console.log('✅ Pandoc found');
    
    // Generate PDF with pandoc
    const pandocCmd = `pandoc "${inputFile}" -o "${outputFile}" --pdf-engine=xelatex -V geometry:margin=1in -V fontsize=11pt -V documentclass=article --toc --toc-depth=2`;
    
    console.log('🔄 Converting markdown to PDF...');
    await execAsync(pandocCmd);
    console.log(`✅ PDF generated: ${outputFile}`);
    
  } catch (error) {
    console.log('⚠️  Pandoc not available, trying markdown-pdf...\n');
    
    // Fallback to markdown-pdf
    try {
      const markdownpdf = (await import('markdown-pdf')).default;
      
      const options = {
        cssPath: path.join(process.cwd(), 'docs/pdf-style.css'),
        paperFormat: 'A4',
        paperOrientation: 'portrait',
        paperBorder: '1cm',
      };
      
      await new Promise((resolve, reject) => {
        markdownpdf(options)
          .from(inputFile)
          .to(outputFile, (err: Error) => {
            if (err) reject(err);
            else resolve(true);
          });
      });
      
      console.log(`✅ PDF generated: ${outputFile}`);
      
    } catch (err) {
      console.log('⚠️  markdown-pdf not available, using simple conversion...\n');
      
      // Ultimate fallback - copy to root and provide instructions
      const mdContent = fs.readFileSync(inputFile, 'utf-8');
      fs.writeFileSync('SuperAdmin_Test_Guide.md', mdContent);
      
      console.log('✅ Markdown file created: SuperAdmin_Test_Guide.md');
      console.log('\n📝 To convert to PDF, use one of these methods:');
      console.log('   1. Install pandoc: brew install pandoc basictex');
      console.log('   2. Use online converter: https://www.markdowntopdf.com/');
      console.log('   3. Open in VS Code and print to PDF');
      console.log('   4. Use Chrome: Open file → Print → Save as PDF\n');
    }
  }
  
  // Verify file size
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    console.log(`\n📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📍 Location: ${path.resolve(outputFile)}\n`);
  }
}

generatePDF().catch(console.error);
