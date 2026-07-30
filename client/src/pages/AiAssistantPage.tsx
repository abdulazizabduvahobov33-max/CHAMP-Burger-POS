import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LogoutButton } from "@/features/auth/LogoutButton";
import { ChampMark } from "@/shared/ui/ChampMark";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { AiChatWidget } from "@/widgets/ai-chat/AiChatWidget";

export default function AiAssistantPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col p-4 [padding-top:max(1rem,env(safe-area-inset-top))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:p-6">
      <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <ChampMark size={28} />
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
              aria-label={t("common.backToAdminAria")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight">{t("ai.title")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <AiChatWidget />
      </div>
    </div>
  );
}
