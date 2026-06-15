import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSocket } from "./hooks/use-socket";
import { Screens } from "./components/Screens";

const queryClient = new QueryClient();

function CookieBanner({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: "#0a0a0a", borderTop: "1px solid #27272a",
        padding: "16px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: "16px", flexWrap: "wrap",
        fontFamily: "monospace",
      }}
    >
      <p style={{ color: "#71717a", fontSize: "11px", letterSpacing: "0.1em", margin: 0, flex: 1 }}>
        THIS SITE USES GOOGLE ANALYTICS TO TRACK ANONYMOUS USAGE (SESSION COUNT, RETENTION).
        NO PERSONAL DATA IS COLLECTED.{" "}
        <a href="/privacy" style={{ color: "#52525b", textDecoration: "underline" }}>PRIVACY POLICY</a>
      </p>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onDecline}
          style={{
            background: "transparent", border: "1px solid #27272a", color: "#52525b",
            fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.15em",
            padding: "8px 16px", cursor: "pointer",
          }}
        >
          DECLINE
        </button>
        <button
          onClick={onAccept}
          style={{
            background: "#DC143C", border: "none", color: "#fff",
            fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.15em",
            padding: "8px 16px", cursor: "pointer",
          }}
        >
          ACCEPT
        </button>
      </div>
    </div>
  );
}

function MainApp() {
  const socketProps = useSocket();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const consent = localStorage.getItem("cipher_cookie_consent");
    if (!consent) setShowBanner(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cipher_cookie_consent", "accepted");
    // @ts-ignore
    if (typeof gtag !== "undefined") gtag("consent", "update", { analytics_storage: "granted" });
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cipher_cookie_consent", "declined");
    setShowBanner(false);
  };

  return (
    <>
      <Screens {...socketProps} />
      {showBanner && <CookieBanner onAccept={handleAccept} onDecline={handleDecline} />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
