import { Injectable } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { InjectModel } from "@nestjs/mongoose";
import { User } from "../../schemas/user";
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

  async findOne(id: string): Promise<User | null> {
    return await this.user.findById(id);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return await this.user.findByIdAndUpdate(id, updateUserDto);
  }

  async remove(id: string): Promise<User | null> {
    return await this.user.findOneAndDelete({ _id: id });
  }
}
