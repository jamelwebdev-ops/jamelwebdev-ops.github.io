PDF COMPRESSOR TOOL
===================

This tool compresses PDF files to 50-75% of their original size.

TWO OPTIONS AVAILABLE:
----------------------

1. NODE.JS VERSION (compress.js) - Works out of the box
2. GHOSTSCRIPT VERSION (compress-gs.bat) - Better compression, requires Ghostscript


OPTION 1: NODE.JS VERSION
-------------------------

Usage:
  node compress.js <input.pdf> [output.pdf] [options]
  node compress.js <directory>

Options:
  -q, --quality <level>   low, medium (default), or high

Examples:
  node compress.js document.pdf
  node compress.js document.pdf compressed.pdf
  node compress.js document.pdf -q low
  node compress.js ./my-pdfs/

Quality Levels:
  low    - Maximum compression (target: 40-50% of original)
  medium - Balanced (target: 50-65% of original)
  high   - Preserve quality (target: 65-80% of original)


OPTION 2: GHOSTSCRIPT VERSION (Recommended for best results)
------------------------------------------------------------

First, install Ghostscript:
  Download: https://ghostscript.com/releases/gsdnld.html

Usage:
  compress-gs.bat input.pdf [output.pdf] [quality]

Quality Levels:
  screen   - Smallest size, lower quality (72 dpi)
  ebook    - Balanced (150 dpi) - DEFAULT
  printer  - High quality (300 dpi)
  prepress - Maximum quality (300 dpi, preserves colors)

Examples:
  compress-gs.bat document.pdf
  compress-gs.bat document.pdf compressed.pdf screen


COMPRESSION TECHNIQUES USED:
----------------------------

- Image downsampling and recompression
- Object stream compression
- Duplicate object removal
- Font compression
- Metadata optimization


TIPS FOR BEST RESULTS:
----------------------

1. PDFs with many images compress better
2. Already-compressed PDFs may not compress much more
3. Use "low" or "screen" quality for documents you'll only view on screen
4. Use "high" or "printer" quality for documents you'll print
5. Scanned documents compress very well with image quality reduction


TROUBLESHOOTING:
----------------

"Original and compressed sizes are similar"
  - The PDF may already be optimized
  - Try a lower quality setting

"Compression failed"
  - The PDF may be password protected
  - Try a different PDF file

For more help, run:
  node compress.js --help
  compress-gs.bat
