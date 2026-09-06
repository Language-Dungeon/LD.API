// from discord.food

interface EmbedField {
  /**
   * The name of the field (max 256 characters)
   */
  name: string;
  /**
   * The value of the field (max 1024 characters)
   */
  value: string;
  /**
   * Whether this field should display inline (default false)
   */
  inline?: boolean;
}
export interface ContentScanMetadata {
  /**
   * The content scan flags of the media
   */
  flags: number;
  /**
   * The version of the explicit content scan filter this media was scanned with
   */
  version: number;
}

export interface EmbedAuthor {
  /**
   * The name of the author (max 256 characters)
   */
  name: string;
  /**
   * URL of the author (only supports http(s)) (max 2048 characters)
   */
  url?: string;
  /**
   * Source URL of the author's icon (only supports http(s) and attachments) (max 2048 characters)
   */
  icon_url?: string;
  /**
   * A proxied URL of the author's icon
   */
  proxy_icon_url?: string;
}

export interface EmbedProvider {
  /**
   * The name of the provider (max 256 characters)
   */
  name?: string;
  /**
   * URL of the provider (max 2048 characters)
   */
  url?: string;
}

export interface EmbedMedia {
  /**
   * Source URL of media (only supports http(s) and attachments) (max 2048 characters)
   */
  url: string;
  /**
   * A proxied URL of the media
   */
  proxy_url?: string;
  /**
   * Height of media
   */
  height?: number;
  /**
   * Width of media
   */
  width?: number;
  /**
   * The media's attachment flags
   */
  flags?: number;
  /**
   * Alt text for the media
   */
  description?: string;
  /**
   * The attachment's media type
   */
  content_type?: string;
  /**
   * The content scan metadata for the media
   */
  content_scan_metadata?: ContentScanMetadata;
  /**
   * The attachment placeholder protocol version (currently 1)
   */
  placeholder_version?: number;
  /**
   * A low-resolution thumbhash of the media, to display before it is loaded
   */
  placeholder?: string;
}

interface EmbedFooter {
  /**
   * The footer text (max 2048 characters)
   */
  text: string;
  /**
   * Source URL of the footer icon (only supports http(s) and attachments) (max 2048 characters)
   */
  icon_url?: string;
  /**
   * A proxied URL of the footer icon
   */
  proxy_icon_url?: string;
}

export interface Embed {
  /**
   * The title of the embed (max 256 characters)
   */
  title?: string;
  /**
   * The type of embed (always rich for sent embeds)
   */
  type?: string;
  /**
   * The description of the embed (max 4096 characters)
   */
  description?: string;
  /**
   * The URL of the embed (max 2048 characters)
   */
  url?: string;
  /**
   * Timestamp of embed content
   */
  timestamp?: string;
  /**
   * The color of the embed encoded as an integer representation of a hexadecimal color code
   */
  color?: number;
  /**
   * Embed footer information
   */
  footer?: EmbedFooter;
  /**
   * Embed image information
   */
  image?: EmbedMedia;
  /**
   * Embed thumbnail information
   */
  thumbnail?: EmbedMedia;
  /**
   * Embed video information
   */
  video?: EmbedMedia;
  /**
   * Embed provider information
   */
  provider?: EmbedProvider;
  /**
   * Embed author information
   */
  author?: EmbedAuthor;
  /**
   * The fields of the embed (max 25)
   */
  fields?: EmbedField[];
  /**
   * The ID of the message this embed was generated from
   */
  reference_id?: string;
  /**
   * The version of the explicit content scan filter this embed was scanned with
   */
  content_scan_version?: number;
  /**
   * The embed's flags
   */
  flags?: number;
}
