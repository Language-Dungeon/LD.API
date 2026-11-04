import { LoggerService } from "@modules/logger";
import { CryptoService } from "@modules/crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthType, User, UserDocument } from "@schemas";
import { SendOTPEmailEvent } from "./events";
import { UpdateUserDto } from "./dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly user: Model<User>,
    @InjectModel(AuthType.name) private readonly authType: Model<AuthType>,
    private readonly crypto: CryptoService,
    private readonly _logger: LoggerService,
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
        activated: false,
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

    this.emiiter.emit(SendOTPEmailEvent.name, new SendOTPEmailEvent({ email }));
    return user;
  }

  async findAll(): Promise<UserDocument[]> {
    return await this.user.find();
  }

  async findOne(id: string): Promise<UserDocument | null> {
    return await this.user.findById(id);
  }

  async findOneByEmail(email: string): Promise<UserDocument | null> {
    const hmacEmail = await this.crypto.encrypt_hmac(email);
    return await this.user.findOne({ email_hmac: hmacEmail });
  }

  async findOneByEmailAndUpdate(email: string, body: UpdateUserDto): Promise<UserDocument | null> {
    const hmacEmail = await this.crypto.encrypt_hmac(email);
    return await this.user.findOneAndUpdate({ email_hmac: hmacEmail }, body);
  }

  async update(id: string, body: UpdateUserDto): Promise<UserDocument | null> {
    return await this.user.findByIdAndUpdate(id, body);
  }

  async remove(id: string): Promise<UserDocument | null> {
    return await this.user.findOneAndDelete({ _id: id });
  }
}
