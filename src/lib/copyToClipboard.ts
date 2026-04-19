export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === 'undefined') return false;

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }
}
