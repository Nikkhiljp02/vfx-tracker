// =============================================================================
// LOGIN SCREEN TOGGLE
// =============================================================================
// Change this to switch between login screens:
// - true  = Enhanced login (Glassmorphism, Neumorphism, Red Carpet, Neon Glow)
// - false = Original login (Simple clean design)
// =============================================================================
const USE_ENHANCED_LOGIN = true;

// =============================================================================
// Import the selected login component
// =============================================================================
import LoginEnhanced from "./LoginEnhanced";
import LoginOriginal from "./LoginOriginal";

export default function LoginPage() {
  // Return the selected login screen based on the toggle above
  return USE_ENHANCED_LOGIN ? <LoginEnhanced /> : <LoginOriginal />;
}
