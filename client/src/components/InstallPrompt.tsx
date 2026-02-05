import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    
    setIsIOS(isIOSDevice);
    setIsStandalone(isInStandaloneMode);

    if (isInStandaloneMode) {
      return;
    }

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (isIOSDevice && !isInStandaloneMode) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
        data-testid="install-prompt"
      >
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white mb-1" data-testid="text-install-title">Install EDIM App</h3>
              {isIOS ? (
                <p className="text-white/80 text-sm" data-testid="text-install-ios-instructions">
                  Tap the share button and select "Add to Home Screen" for the best experience
                </p>
              ) : (
                <p className="text-white/80 text-sm" data-testid="text-install-description">
                  Add EDIM to your home screen for quick access and offline support
                </p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDismiss}
              className="shrink-0 text-white"
              data-testid="button-dismiss-install"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          {!isIOS && deferredPrompt && (
            <Button
              onClick={handleInstall}
              className="w-full mt-3 bg-white text-purple-600"
              data-testid="button-install-app"
            >
              <Download className="w-4 h-4 mr-2" />
              Install Now
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
