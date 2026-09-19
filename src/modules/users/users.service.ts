import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { UpdateUserDto } from "./dto/update-user.dto";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "../../schemas/user";
import { Model } from "mongoose";
import { CryptoService } from "@modules/crypto";
import { AuthType } from "../../schemas/authType";
import { LoggerService } from "@modules/logger";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly user: Model<User>,
    @InjectModel(AuthType.name) private readonly authType: Model<AuthType>,
    private readonly crypto: CryptoService,
    private readonly logger: LoggerService,
  ) {}

  async create(email: string, username: string, password: string | null): Promise<UserDocument> {
    const session = await this.user.startSession();
    try {
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
      return user;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException();
    } finally {
      session.endSession();
    }
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

  async findOneByEmailAndUpdate(email: string, updateUserDto: UpdateUserDto) {
    const hmacEmail = await this.crypto.encrypt_hmac(email);
    return await this.user.findOneAndUpdate({ email_hmac: hmacEmail }, updateUserDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument | null> {
    return await this.user.findByIdAndUpdate(id, updateUserDto);
  }

  async remove(id: string): Promise<UserDocument | null> {
    return await this.user.findOneAndDelete({ _id: id });
  }
}
