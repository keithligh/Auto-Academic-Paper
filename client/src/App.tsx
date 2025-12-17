import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import LandingPage from "@/pages/LandingPage";
import ProcessingPage from "@/pages/ProcessingPage";
import ResultPage from "@/pages/ResultPage";
import ConfigPage from "@/pages/ConfigPage";
import ManualPage from "@/pages/ManualPage";
import NotFound from "@/pages/not-found";

function Router() {
    return (
        <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/config" component={ConfigPage} />
            <Route path="/processing/:id" component={ProcessingPage} />
            <Route path="/results/:id" component={ResultPage} />
            <Route path="/manual" component={ManualPage} />
            <Route component={NotFound} />
        </Switch>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router />
            <Toaster />
        </QueryClientProvider>
    );
}

export default App;
