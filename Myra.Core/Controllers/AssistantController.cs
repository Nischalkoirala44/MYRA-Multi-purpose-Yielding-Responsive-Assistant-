using Microsoft.AspNetCore.Mvc;
using Myra.Core.Models;
using Myra.Core.Services;

namespace Myra.Core.Controllers;

[ApiController]
[Route("api/assistant")]
public class AssistantController : ControllerBase
{
    private readonly OllamaService _ollamaService;
    private readonly SystemService _systemService;

    public AssistantController(OllamaService ollamaService, SystemService systemService)
    {
        _ollamaService = ollamaService;
        _systemService = systemService;
    }

    [HttpPost("process")]
    public async Task<IActionResult> ProcessCommand([FromBody] IntentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Input))
            return BadRequest(new { status = "Error", message = "Input prompt cannot be empty." });

        string userInput = request.Input.Trim().ToLowerInvariant();

        // 1. Synchronize mode from frontend request if provided
        if (!string.IsNullOrEmpty(request.ActiveMode))
        {
            _ollamaService.SetMode(request.ActiveMode);
        }

        // 2. Intercept explicit mode switch triggers directly in C#
        if (userInput.Contains("activate coding") || userInput.Contains("coding mode"))
        {
            _ollamaService.SetMode("CODING");
        }
        else if (userInput.Contains("activate system control") || userInput.Contains("system control mode"))
        {
            _ollamaService.SetMode("SYSTEMCONTROL");
        }
        else if (userInput.Contains("deactivate") || userInput.Contains("flirt mode") || userInput.Contains("let's flirt"))
        {
            _ollamaService.SetMode("FLIRT");
        }

        // 3. Process intent via Ollama in the current persistent mode
        var intent = await _ollamaService.ParseIntentAsync(request.Input);

        if (intent == null)
            return BadRequest(new { status = "Error", message = "Could not parse intent from local LLM." });

        string executionOutput = string.Empty;

        // 4. Execute system action based on LLM intent
        switch (intent.Action.ToUpperInvariant())
        {
            case "OPEN_APP":
                string target = (intent.Target ?? "").ToLower();

                if (target.Contains("youtube"))
                {
                    executionOutput = _systemService.ExecuteCommand("cmd.exe", "/c start https://www.youtube.com");
                }
                else if (target.Contains("notepad"))
                {
                    executionOutput = _systemService.ExecuteCommand("cmd.exe", "/c start notepad");
                }
                else
                {
                    executionOutput = _systemService.ExecuteCommand("cmd.exe", $"/c start {intent.Target}");
                }
                break;

            case "SYSTEM_CONTROL":
                executionOutput = intent.Target;
                break;

            default:
                executionOutput = intent.Target;
                break;
        }

        // 5. Return execution result alongside the active state
        return Ok(new
        {
            action = intent.Action,
            target = intent.Target,
            result = executionOutput,
            currentMode = OllamaService.CurrentMode.ToString().ToUpper()
        });
    }
}