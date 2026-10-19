import { del, get, put } from "@vercel/blob";

// Files live in a private Vercel Blob store.
//   uploads/...  files sent through a form: only served to signed-in users with access
//   images/...   pictures used by Image blocks: served publicly through /api/forms/media/
// Auth is either a read/write token or, on Vercel, OIDC plus the store id.

export function storageConfigured() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function putFile(pathname: string, body: Blob | ArrayBuffer | Buffer, contentType: string) {
  const res = await put(pathname, body, { access: "private", contentType, addRandomSuffix: true });
  return { url: res.url, pathname: res.pathname };
}

export async function getFile(pathname: string) {
  return get(pathname, { access: "private" });
}

export async function deleteFiles(pathnames: string[]) {
  if (!pathnames.length || !storageConfigured()) return;
  await del(pathnames).catch(() => {
    // Orphaned blobs are harmless; never block a delete on storage errors.
  });
}

export const FILE_ROUTE = "/api/admin/forms/files/";
export const MEDIA_ROUTE = "/api/forms/media/";

/** The value stored in an answer for an uploaded file. */
export const fileAnswer = (pathname: string) => `${FILE_ROUTE}${pathname}`;
