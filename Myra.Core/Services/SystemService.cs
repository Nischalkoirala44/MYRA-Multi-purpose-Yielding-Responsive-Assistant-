using System.Diagnostics;
namespace Myra.Core.Services;

public class SystemService
{
    public string ExecuteCommand(string command, string args = "")
    {
        try
        {
            var processInfo = new ProcessStartInfo
            {
                FileName = command,
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(processInfo);
            if (process == null) return "Failed to start process.";
            
            string output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            return string.IsNullOrEmpty(output) ? "Command executed." : output;
        }
        catch (Exception ex)
        {
            return $"Error executing command: {ex.Message}";
        }
    }
}