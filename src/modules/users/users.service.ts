import { Injectable } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "../../schemas/user";
import { Model } from "mongoose";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly user: Model<User>) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    return await this.user.create({
      ...createUserDto,
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
    return await this.user.findOne({ email: email });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return await this.user.findByIdAndUpdate(id, updateUserDto);
  }

  async remove(id: string): Promise<User | null> {
    return await this.user.findOneAndDelete({ _id: id });
  }
}
