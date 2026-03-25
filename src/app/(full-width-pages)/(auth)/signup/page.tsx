import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "QRDine Admin SignUp Page",
  description: "This is QRDine Admin SignUp Page",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
