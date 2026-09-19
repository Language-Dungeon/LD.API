import { Injectable } from "@nestjs/common";
import { UpdateUserDto } from "./dto/update-user.dto";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "../../schemas/user";
import { Model } from "mongoose";
import { CryptoService } from "@modules/crypto";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly user: Model<User>,
    private readonly crypto: CryptoService,
  ) {}

  async create(email: string, username: string, password: string | null): Promise<UserDocument> {
    return await this.user.create({
      username: username,
      email_hmac: this.crypto.encrypt_hmac(email),
      email: await this.crypto.encrypt(email),
      password: password != null ? await this.crypto.hash(password) : null,
      activated: false,
    });
  }

  async findAll(): Promise<User[]> {
    return await this.user.find();
  }

  async findOne(id: string): Promise<UserDocument | null> {
    return await this.user.findById(id);
  }

  async findOneByEmail(email: string): Promise<UserDocument | null> {
    const hmacEmail = await this.crypto.encrypt_hmac(email);
    return await this.user.findOne({ email_hmac: hmacEmail });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return await this.user.findByIdAndUpdate(id, updateUserDto);
  }

  async remove(id: string): Promise<User | null> {
    return await this.user.findOneAndDelete({ _id: id });
  }
}
