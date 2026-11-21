const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export async function uploadImageToCloudinary(base64Image) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", base64Image);
  formData.append("upload_preset", UPLOAD_PRESET);
  try {
    const response = await fetch(url, { method: "POST", body: formData });
    const data = await response.json();
    if (data.secure_url) return { ok: true, url: data.secure_url };
    return { ok: false, error: data.error?.message || "Error de subida" };
  } catch (error) {
    return { ok: false, error: "Error de red al subir la imagen" };
  }
}