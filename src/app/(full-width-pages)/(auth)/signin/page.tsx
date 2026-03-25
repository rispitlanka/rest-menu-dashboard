import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "QRDine Admin SignIn Page",
  description: "This is QRDine Admin SignIn Page",
};

export default function SignIn() {
  return <SignInForm />;
}
