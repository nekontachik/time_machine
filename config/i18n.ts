import "server-only";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  const raw = cookies().get("locale")?.value;
  const locale = raw === "en" ? "en" : "uk";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
