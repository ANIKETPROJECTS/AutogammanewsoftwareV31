import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReportingStatus = {
  configured: boolean;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  validBaseUrl: boolean;
  missingKeys: string[];
  coveredMessages: string[];
  lastReport: { status: string; reason?: string; at: string } | null;
};

export function WhatsAppLiveChatSettings() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<ReportingStatus>({
    queryKey: ["/api/integrations/airavata/outbound-status"],
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Live Chat</CardTitle>
        <CardDescription>
          One Airavata connection records messages sent by this app. It does not send them again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <p>Loading connection status...</p>}
        {error && <p role="alert" className="text-red-700">Unable to load Live Chat configuration.</p>}
        {data && <>
          <p className={data.configured ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
            {data.configured ? "Configured — verify recording after a normal send" : "Setup required — outgoing messages may be missing from Live Chat"}
          </p>
          <p>Solution URL: <span className="break-all">{data.baseUrl || "Not configured correctly"}</span></p>
          <p>Airavata API key: {data.apiKeyConfigured ? "Configured (hidden)" : "Missing"}</p>
          {data.missingKeys.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="font-medium">Set these on the server running AutoGamma:</p>
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {data.missingKeys.map(key => <li key={key}>{key}</li>)}
            </ul>
          </div>}
          {!data.validBaseUrl && <p className="text-amber-700">Use an HTTPS origin such as https://app.atwassup.com, without an API path.</p>}
          <p className="text-xs text-muted-foreground">
            The dedicated Airavata tenant key belongs in the secure server environment as AIRAVATA_API_KEY.
            It is not your Meta access token. These settings apply to every sending path.
          </p>
          <p>Covered: {data.coveredMessages.join("; ")}.</p>
          {data.lastReport && <p role="status" className={data.lastReport.status === "recorded" ? "text-emerald-700" : "text-amber-700"}>
            Last report since restart: {data.lastReport.status}
            {data.lastReport.reason ? ` (${data.lastReport.reason})` : ""}
            {" — "}{new Date(data.lastReport.at).toLocaleString("en-IN")}
          </p>}
          <p className="text-xs text-muted-foreground">
            Successful Meta acceptance and Live Chat recording are separate. Failed reports never resend customer messages.
            Old messages are not backfilled automatically.
          </p>
        </>}
        <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? "Refreshing..." : "Refresh status"}
        </Button>
      </CardContent>
    </Card>
  );
}
