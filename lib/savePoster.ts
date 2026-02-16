import { supabase } from "./supabase"
import { v4 as uuidv4 } from "uuid"

export async function savePoster({
  imageBlob,
  routeName,
  config,
}: {
  imageBlob: Blob
  routeName: string
  config: Record<string, unknown>
}) {
  const id = uuidv4()
  const filePath = `${id}.png`

  const { error: uploadError } = await supabase.storage
    .from("poster-images")
    .upload(filePath, imageBlob, {
      contentType: "image/png",
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from("poster-images")
    .getPublicUrl(filePath)

  const imageUrl = data.publicUrl

  const { error: dbError } = await supabase
    .from("posters")
    .insert({
      id,
      route_name: routeName,
      image_url: imageUrl,
      preview_url: imageUrl,
      config,
    })

  if (dbError) {
    throw dbError
  }

  return {
    posterId: id,
    imageUrl,
  }
}
