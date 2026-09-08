namespace Myra.Core.Models;

public class IntentResult
{
    public string Action { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
}

public class IntentRequest
{
    public string Input { get; set; } = string.Empty;
    public string? ActiveMode { get; set; }
}