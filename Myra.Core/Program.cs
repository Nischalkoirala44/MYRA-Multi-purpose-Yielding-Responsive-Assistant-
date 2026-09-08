using Myra.Core.Services;

var builder = WebApplication.CreateBuilder(args);

// Bind to all network interfaces (IPv4 and IPv6) on port 5000
builder.WebHost.UseUrls("http://*:5000");

builder.Services.AddControllers();

// Register Services
// FIX: Use AddHttpClient to automatically inject HttpClient into OllamaService
builder.Services.AddHttpClient<OllamaService>(client =>
{
    client.BaseAddress = new Uri("http://localhost:11434");
    client.Timeout = TimeSpan.FromMinutes(5);             
});

builder.Services.AddSingleton<SystemService>();


// CORS Setup
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowHUD", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowHUD");
app.UseAuthorization();

// IMPORTANT: Maps attribute routes ([Route("api/assistant")])
app.MapControllers();

app.Run();