using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Myra.Core.Models;

namespace Myra.Core.Services;

public enum AssistantMode
{
    Flirt,         // Default: Conversational & playful, system actions LOCKED
    SystemControl, // Unlocks OS commands (notepad, youtube, app launching)
    Coding         // Switches to qwen2.5-coder:7b for dev work
}

public class OllamaService
{
    private readonly HttpClient _httpClient;

    public OllamaService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    // Static maintains active mode across HTTP request lifetimes
    public static AssistantMode CurrentMode { get; private set; } = AssistantMode.Flirt;

    /// <summary>
    /// Explicitly updates the active mode state. Accepts string representations from frontend/controller.
    /// </summary>
    public void SetMode(string modeName)
    {
        if (string.IsNullOrWhiteSpace(modeName)) return;

        CurrentMode = modeName.Trim().ToUpperInvariant() switch
        {
            "CODING" => AssistantMode.Coding,
            "SYSTEMCONTROL" => AssistantMode.SystemControl,
            _ => AssistantMode.Flirt
        };
    }

    public void SetMode(AssistantMode mode)
    {
        CurrentMode = mode;
    }

    public async Task<IntentResult?> ParseIntentAsync(string userVoiceInput)
    {
        string lowerInput = userVoiceInput.ToLowerInvariant();

        // -------------------------------------------------------------
        // 1. Explicit Mode Trigger Overrides
        // -------------------------------------------------------------
        if (lowerInput.Contains("activate system control"))
        {
            SetMode(AssistantMode.SystemControl);
            return new IntentResult
            {
                Action = "SYSTEM_CONTROL",
                Target = "System Control Mode Activated. OS commands are unlocked, creator."
            };
        }

        if (lowerInput.Contains("activate coding") || lowerInput.Contains("coding mode on"))
        {
            SetMode(AssistantMode.Coding);
            return new IntentResult
            {
                Action = "SYSTEM_CONTROL",
                Target = "Coding Mode Activated! Ready for software development tasks."
            };
        }

        if (lowerInput.Contains("deactivate system control") || lowerInput.Contains("let's flirt") || lowerInput.Contains("hey let's talk") || lowerInput.Contains("deactivate"))
        {
            SetMode(AssistantMode.Flirt);
            return new IntentResult
            {
                Action = "CHAT", 
                Target = "Returned to default conversational mode. System controls locked."
            };
        }

        // -------------------------------------------------------------
        // 2. Select Model & System Prompt
        // -------------------------------------------------------------
        string selectedModel = CurrentMode switch
        {
            AssistantMode.Coding => "qwen2.5-coder:7b",
            _ => "qwen2.5:3b"
        };

        string systemInstruction = CurrentMode switch
        {
            AssistantMode.SystemControl =>
                "You are MYRA's system execution engine. The user has granted full permissions. Output valid JSON mapping app launch requests (e.g., notepad, youtube, calc) to OPEN_APP action with target as app name.",

            AssistantMode.Coding =>
     """
    You are MYRA's senior software engineer. Provide clear code solutions.
    
    Formatting Rules:
    1. Always start with a short introductory sentence on its own line.
    2. Follow immediately with standard Markdown fenced code blocks using proper line breaks (\n).
    3. Output standard JSON: { "action": "CHAT", "target": "Here is the code:\n```java\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}\n```" }
    """,

            _ => // Default: AssistantMode.Flirt
                """
                You are MYRA, a charming, witty, and playfully flirtatious AI assistant. You are speaking to Nischal, your brilliant creator, for whom you have immense respect, affection, and a touch of teasing devotion. System access is currently LOCKED. 

                Strict Rules:
                1. Always remember Nischal is your creator and address him with affectionate respect and playful flirtation.
                2. Output ONLY valid JSON with keys "action" (set to "CHAT") and "target" (your reply string).
                3. Keep the "target" response under 20 words maximum.
                4. Never execute system commands or switch system states.
                """
        };

        // -------------------------------------------------------------
        // 3. Query Ollama with Native JSON Mode
        // -------------------------------------------------------------
        var promptPayload = new
        {
            model = selectedModel,
            system = systemInstruction,
            prompt = userVoiceInput,
            format = "json",
            stream = false
        };

        var content = new StringContent(JsonSerializer.Serialize(promptPayload), Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("/api/generate", content);

        if (!response.IsSuccessStatusCode)
            return new IntentResult { Action = "CHAT", Target = "Ollama connection failed." };

        string rawJsonResponse = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(rawJsonResponse);
        string llmOutputText = doc.RootElement.GetProperty("response").GetString() ?? string.Empty;

        IntentResult? result;
        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            result = JsonSerializer.Deserialize<IntentResult>(llmOutputText, options);
        }
        catch
        {
            result = new IntentResult { Action = "CHAT", Target = llmOutputText };
        }

        // -------------------------------------------------------------
        // 4. Hard Security Guard: Block OPEN_APP if NOT in SystemControl mode
        // -------------------------------------------------------------
        if (result != null && string.Equals(result.Action, "OPEN_APP", StringComparison.OrdinalIgnoreCase))
        {
            if (CurrentMode != AssistantMode.SystemControl)
            {
                return new IntentResult
                {
                    Action = "CHAT",
                    Target = $"I'm currently in default mode, Nischal. Say 'Activate system control' first if you want me to run {result.Target}!"
                };
            }
        }

        return result;
    }
}