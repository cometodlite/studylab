const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

export async function uploadToStorage(
  filePath: string,
  buffer: ArrayBuffer,
  contentType: string,
  token: string
): Promise<string> {
  const encodedPath = encodeURIComponent(filePath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${token}`,
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Storage upload failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json() as { name: string; downloadTokens?: string };
  const token_ = data.downloadTokens ?? '';
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media${token_ ? `&token=${token_}` : ''}`;
}
