import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { MongoClient } from "mongodb";
export const db = new PrismaClient();
export const mongo = new MongoClient(
  process.env.MONGODB_URL || "mongodb://localhost:27017/readiness",
  { serverSelectionTimeoutMS: 2000 },
);
export const events = mongo.db().collection("events");
