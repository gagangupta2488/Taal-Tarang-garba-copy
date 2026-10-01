import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Student } from "./api";

const KEY = "ttg.my_pass";

export async function saveMyPass(student: Student) {
  await AsyncStorage.setItem(KEY, JSON.stringify(student));
}

export async function loadMyPass(): Promise<Student | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Student;
  } catch {
    return null;
  }
}

export async function clearMyPass() {
  await AsyncStorage.removeItem(KEY);
}
