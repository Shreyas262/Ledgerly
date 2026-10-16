/**
 * Opens fetched content in a new tab. The tab is opened synchronously so it is
 * not treated as a blocked popup, then pointed at the temporary object URL once
 * it has been retrieved. When retrieval fails the tab is closed and the error
 * is passed on.
 */
export async function openObjectUrlInNewTab(fetchObjectUrl: () => Promise<string>): Promise<void> {
  const previewWindow = window.open("", "_blank");
  if (previewWindow) previewWindow.opener = null;

  try {
    const objectUrl = await fetchObjectUrl();
    if (previewWindow) {
      previewWindow.location.href = objectUrl;
    } else {
      window.open(objectUrl, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}
