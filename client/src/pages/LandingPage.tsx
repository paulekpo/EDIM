import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Trophy, BarChart3, ArrowRight, Brain } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3 border rounded-lg px-4 py-2">
            <Brain className="w-8 h-8 text-primary" />
            <div className="flex flex-col">
              <span className="text-xl font-bold leading-tight">EDIM</span>
              <span className="text-xs text-muted-foreground">Entertainment Data to Idea Management</span>
            </div>
          </div>
          <a href="/api/login">
            <Button data-testid="button-login">Sign In</Button>
          </a>
        </header>

        <main className="max-w-4xl mx-auto">
          <section className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Stop Guessing What
              <span className="text-primary block">Videos To Create</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Upload analytics screenshot and let EDIM do it for you.
            </p>
            <a href="/api/login">
              <Button size="lg" className="gap-2" data-testid="button-get-started">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </section>

          <section className="grid md:grid-cols-3 gap-6 mb-16">
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Import Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your channel or page analytics to generate personalized content ideas based on what works.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Spin for Ideas</h3>
                <p className="text-sm text-muted-foreground">
                  Use the Ideas Wheel to randomly select your next video idea and eliminate decision fatigue.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Track Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Level up from Amateur to Expert as you complete videos and build your content library.
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="text-center">
            <p className="text-sm text-muted-foreground">
              Free to use. No credit card required.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
