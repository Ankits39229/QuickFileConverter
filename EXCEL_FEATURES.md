# Excel Converter Features

The File Converter Toolkit now includes comprehensive Excel processing features alongside the existing PDF tools.

## Features Overview

### 1. **Merge Excel Files**
- Combine multiple Excel workbooks into a single file
- Each workbook's sheets are preserved with unique names
- Maintains all formatting, formulas, and styles
- **Usage**: Select 2 or more `.xlsx` or `.xls` files

### 2. **Split Excel Sheets**
- Extract each worksheet into separate Excel files
- Perfect for distributing individual sheets from a workbook
- **Usage**: Select 1 Excel file
- **Output**: ZIP file containing separate .xlsx files for each sheet

### 3. **Compress Excel**
- Reduce Excel file size with optimization levels:
  - **Low**: Minimal optimization (10-20% reduction)
  - **Medium**: Balanced optimization (20-40% reduction) - removes non-essential formatting
  - **High**: Maximum optimization (40-60% reduction) - removes most formatting and empty rows
- **Usage**: Select 1 Excel file

### 4. **Excel to PDF**
- Convert Excel spreadsheets to PDF documents
- Renders visible data with formatting preserved
- **Usage**: Select 1 Excel file
- **Output**: PDF file

### 5. **Excel to CSV**
- Export a specific sheet to CSV format
- Select which sheet to export from dropdown
- Perfect for data analysis and import to other systems
- **Usage**: Select 1 Excel file, choose sheet

### 6. **Remove Sheets**
- Delete specific worksheets from an Excel file
- Multi-select sheets to remove
- Prevents removing all sheets (at least one must remain)
- **Usage**: Select 1 Excel file, check sheets to remove

### 7. **Protect Excel**
- Add password protection to all sheets in a workbook
- Protects against unauthorized editing
- Users can still view data but cannot modify without password
- **Usage**: Select 1 Excel file, enter password

### 8. **Sort Data**
- Sort Excel data by any column
- Choose ascending or descending order
- Select specific sheet to sort
- Preserves header row
- **Usage**: Select 1 Excel file, choose sheet, column index, and sort order

### 9. **Filter Data**
- Filter rows based on column value (contains match)
- Creates new Excel file with filtered results
- Select specific sheet and column
- Case-insensitive search
- **Usage**: Select 1 Excel file, choose sheet, column, and filter text

## Technical Implementation

### Backend Library
All Excel operations use the **ExcelJS** library, which provides:
- Full .xlsx and .xls support
- Rich formatting preservation
- Formula support
- Style and cell formatting
- Merged cells handling

### File Processing
- All operations run **locally** in the browser
- Files never leave your device
- No server uploads required
- Fast, secure, and private

### Supported Formats
- **Input**: `.xlsx`, `.xls`
- **Output**: `.xlsx` (modern Excel format), `.csv`, `.pdf`

## Usage Tips

1. **Order Matters**: When merging files, arrange them in the desired order using the up/down arrows
2. **Sheet Names**: Original sheet names are preserved when possible; duplicates get prefixed with file number
3. **Column Indexing**: Columns use 1-based indexing (A=1, B=2, C=3, etc.)
4. **Large Files**: For very large Excel files, some operations may take longer - be patient!
5. **Formulas**: Most operations preserve formulas, but converting to PDF/CSV evaluates them

## Integration

The Excel tools are seamlessly integrated into the existing File Converter Toolkit:
- **Tabbed Interface**: Switch between PDF Tools and Excel Tools
- **Consistent UI**: Same drag-and-drop interface as PDF tools
- **Unified Experience**: Same styling and user flow

## Future Enhancements

Potential future features:
- Convert Word to Excel (tables)
- Excel formula validation
- Data visualization preview
- Bulk operations on multiple files
- Custom column selection for CSV export
- Advanced filtering (multiple criteria)
- Pivot table support

## Examples

### Merging Multiple Reports
1. Click "Excel Tools" tab
2. Select "Merge Excel"
3. Upload multiple monthly reports
4. Click "Merge Excel Files"
5. Download combined workbook

### Exporting for Analysis
1. Select "Excel to CSV"
2. Upload your data file
3. Choose the sheet containing your data
4. Click "Export to CSV"
5. Import CSV into your analysis tool

### Protecting Sensitive Data
1. Select "Protect Excel"
2. Upload your workbook
3. Enter a strong password
4. Click "Protect Excel"
5. Share the protected file securely

---

**Note**: All processing happens locally in your browser. No data is sent to any server, ensuring complete privacy and security.
