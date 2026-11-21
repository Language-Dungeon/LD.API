import { CryptoService } from "@modules/crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthType, User, UserDocument } from "@schemas";
import { SendOTPEmailEvent } from "./events";
import { UpdateUserDto } from "./dto";
import { EXPIRES_IN_10MINS, USER_KEY, UserLean } from "@types";
import { Cache } from "@nestjs/cache-manager";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly user: Model<User>,
    @InjectModel(AuthType.name) private readonly authType: Model<AuthType>,
    private readonly crypto: CryptoService,
    private readonly cache: Cache,
    private readonly emiiter: EventEmitter2,
  ) {}

  async create(email: string, username: string, password: string | null): Promise<UserDocument> {
    const session = await this.user.startSession();
    const user = await session.withTransaction(async (s): Promise<UserDocument> => {
      const createdUser = await this.user.create({
        username: username,
        email_hmac: this.crypto.encrypt_hmac(email),
        email: await this.crypto.encrypt(email),
        password: password != null ? await this.crypto.hash(password) : null,
      });
      await this.authType.create({
        email_hmac: createdUser.email_hmac,
        user_id: createdUser.id,
        auth_provider: password != null ? "local" : "google",
      });

      await s.commitTransaction();
      return createdUser;
    });

    await session.endSession();

    this.emiiter.emit(SendOTPEmailEvent.name, new SendOTPEmailEvent({ email: user.email }));
    return user;
  }

  async findAll(): Promise<UserLean[]> {
    return await this.user.find().lean();
  }

  async findOne(id: string): Promise<UserLean | null> {
    return await this.readThroughCache<UserLean | null>(`${USER_KEY}:${id}`, () => this.user.findById(id).lean());
  }

  async findOneByEmail(email: string): Promise<UserLean | null> {
    // const hmacEmail = this.crypto.encrypt_hmac(email);
    return await this.user.findOne({ email_hmac: email }).lean();
  }

  async findOneByEmailWithPassword(email: string): Promise<UserDocument | null> {
    //const hmacEmail = this.crypto.encrypt_hmac(email);
    return await this.user.findOne({ email_hmac: email }).select("+password");
  }
  async findOneByIdWithPassword(id: string): Promise<UserDocument | null> {
    return await this.user.findById(id).select("+password");
  }

  async findOneByEmailAndUpdate(email: string, body: UpdateUserDto): Promise<UserLean | null> {
    return await this.user.findOneAndUpdate({ email_hmac: email }, body).lean();
  }

  async update(id: string, body: UpdateUserDto): Promise<UserLean | null> {
    return await this.user.findByIdAndUpdate(id, body).lean();
  }

  async remove(id: string): Promise<UserLean | null> {
    return await this.user.findOneAndDelete({ _id: id }).lean();
  }

  private async readThroughCache<T>(key: string, fetchDB: () => Promise<T>): Promise<T> {
    const cacheValue = await this.cache.get<string>(key);
    if (cacheValue) return JSON.parse(await this.crypto.decrypt(cacheValue)) as Promise<T>;

    const dbValue = await fetchDB();
    await this.cache.set(key, await this.crypto.encrypt(JSON.stringify(dbValue)), EXPIRES_IN_10MINS * 1000);

    return dbValue;
  }
}
