/**
 * Utility functions for handling file names and preventing conflicts
 */

/**
 * Extract filename without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return filename;
  return filename.substring(0, lastDotIndex);
}

/**
 * Extract file extension
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return filename.substring(lastDotIndex);
}

/**
 * Generate unique filename by adding counter if duplicate exists
 */
export function generateUniqueFilename(
  desiredName: string,
  existingNames: string[]
): string {
  // If no conflict, return original name
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }

  const nameWithoutExt = getFileNameWithoutExtension(desiredName);
  const extension = getFileExtension(desiredName);

  let counter = 1;
  let newName = `${nameWithoutExt}-${counter}${extension}`;

  // Keep incrementing until we find a unique name
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${nameWithoutExt}-${counter}${extension}`;
  }

  return newName;
}

/**
 * Generate unique filenames for batch of files
 */
export function generateUniqueFilenames(
  files: Array<{ name: string; [key: string]: any }>
): Array<{ name: string; originalName: string; [key: string]: any }> {
  const existingNames: string[] = [];
  
  return files.map((file) => {
    const uniqueName = generateUniqueFilename(file.name, existingNames);
    existingNames.push(uniqueName);
    
    return {
      ...file,
      originalName: file.name,
      name: uniqueName,
    };
  });
}

/**
 * Create download link with unique filename
 */
export function createDownloadLink(
  url: string,
  filename: string,
  existingDownloads: string[] = []
): HTMLAnchorElement {
  const uniqueFilename = generateUniqueFilename(filename, existingDownloads);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = uniqueFilename;
  
  return link;
}

/**
 * Batch download files with unique names
 */
export async function batchDownloadFiles(
  files: Array<{ url: string; name: string }>
): Promise<void> {
  const existingNames: string[] = [];
  
  for (const file of files) {
    const uniqueName = generateUniqueFilename(file.name, existingNames);
    existingNames.push(uniqueName);
    
    const link = document.createElement('a');
    link.href = file.url;
    link.download = uniqueName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Small delay between downloads to prevent browser blocking
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
