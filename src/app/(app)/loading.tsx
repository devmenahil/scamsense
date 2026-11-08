import { LoadingState } from "@/components/ui/Spinner";

export default function AppLoading() {
  return (
    <div className="container-page">
      <LoadingState label="Loading your training…" />
    </div>
  );
}
