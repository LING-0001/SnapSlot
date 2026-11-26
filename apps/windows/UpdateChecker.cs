using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

namespace SnapSlot;

internal sealed record UpdateOutcome(string Status, string CurrentVersion, string? LatestVersion = null, string? ReleaseUrl = null, string? Message = null);

internal static class UpdateChecker
{
    private const string Endpoint = "https://api.github.com/repos/LING-0001/SnapSlot/releases/latest";
    private const string DefaultReleasePage = "https://github.com/LING-0001/SnapSlot/releases";

    public static bool IsAllowedExternalUrl(string? raw)
    {
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) || !string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
            return false;
        var host = uri.Host.ToLowerInvariant();
        if (host == "github.com" && uri.AbsolutePath.StartsWith("/LING-0001/SnapSlot", StringComparison.Ordinal))
            return true;
        return host == "snapslot.linglinglab.top";
    }

    public static async Task<UpdateOutcome> CheckAsync(string currentVersion)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            using var request = new HttpRequestMessage(HttpMethod.Get, Endpoint);
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("SnapSlot", currentVersion));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            using var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return new("error", currentVersion);
            var body = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (!root.TryGetProperty("tag_name", out var tagProp) || tagProp.GetString() is not string tag || string.IsNullOrWhiteSpace(tag))
                return new("error", currentVersion);
            string releaseUrl = root.TryGetProperty("html_url", out var urlProp) && IsAllowedExternalUrl(urlProp.GetString())
                ? urlProp.GetString()!
                : DefaultReleasePage;
            return SemVer.IsNewer(tag, currentVersion)
                ? new("available", currentVersion, tag, releaseUrl)
                : new("upToDate", currentVersion, tag, releaseUrl);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
        {
            return new("error", currentVersion);
        }
    }
}
