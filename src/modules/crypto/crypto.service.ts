import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Config } from "@types";
import * as argon2 from "argon2";
import { randomBytes, scrypt, createCipheriv, createDecipheriv } from "crypto";
import { promisify } from "util";

@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService<Config>) {}

  /**
   *
   * @author przdev7
   * @description
   * nie ma potrzeby customowego saltu bo automatycznie library oferuje juz
   *
   * @param text plain text to be hashed
   * @returns hashed text
   */
  async hash(text: string): Promise<string> {
    return await argon2.hash(text, {
      type: argon2.argon2id,
      parallelism: 4,
      secret: Buffer.from(this.config.getOrThrow<string>("PASSWORD_HASH_SECRET"), "utf8"),
    });
  }

  /**
   *
   * @author przdev7
   * @description
   * Weryfikuje czy plaintext zgadza sie z hashem z bazy
   *
   * @param hash hashed text
   * @param plain plain text to be verified
   * @returns boolean
   */
  async verifyHash(hash: string, plain: string): Promise<boolean> {
    return await argon2.verify(hash, plain, {
      secret: Buffer.from(this.config.getOrThrow("PASSWORD_HASH_SECRET")),
    });
  }

  async encrypt(text: string) {
    const iv = randomBytes(16);

    const key = (await promisify(scrypt)(this.config.getOrThrow("ENCRYPTION_SECRET"), "salt", 32)) as Buffer;
    const cipher = createCipheriv("aes-256-ctr", key, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString("base64");
  }

  async decrypt(encryptedText: string) {
    const data = Buffer.from(encryptedText, "base64");

    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);

    const key = (await promisify(scrypt)(this.config.getOrThrow("ENCRYPTION_SECRET"), "salt", 32)) as Buffer;
    const decipher = createDecipheriv("aes-256-ctr", key, iv);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}
