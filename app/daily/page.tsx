"use client";

import { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation } from "@/components/navigation";
import { SchoolMap } from "@/components/school-map";
import {
  dailyChallenges,
  getLocationById,
  calculateScore,
  formatDate,
  getTodayDateString,
  type DailyChallenge,
  type Location,
} from "@/lib/game-data";

type DailyState = "selecting" | "playing" | "result";

interface CompletedChallenge {
  date: string;
  score: number;
  guessX: number;
  guessY: number;
}

export default function DailyPage() {
  const [dailyState, setDailyState] = useState<DailyState>("selecting");
  const [selectedChallenge, setSelectedChallenge] = useState<DailyChallenge | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [guessPosition, setGuessPosition] = useState<{ x: number; y: number } | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [currentScore, setCurrentScore] = useState(0);

  const todayString = useMemo(() => getTodayDateString(), []);
  const todayChallenge = useMemo(
    () => dailyChallenges.find((c) => c.date === todayString),
    [todayString]
  );

  const isCompleted = useCallback(
    (date: string) => completedChallenges.some((c) => c.date === date),
    [completedChallenges]
  );

  const getCompletedScore = useCallback(
    (date: string) => completedChallenges.find((c) => c.date === date)?.score,
    [completedChallenges]
  );

  const startChallenge = useCallback((challenge: DailyChallenge) => {
    const location = getLocationById(challenge.locationId);
    if (!location) return;

    setSelectedChallenge(challenge);
    setCurrentLocation(location);
    setGuessPosition(null);
    setCurrentScore(0);
    setDailyState("playing");
  }, []);

  const handleGuess = useCallback((x: number, y: number) => {
    setGuessPosition({ x, y });
  }, []);

  const submitGuess = useCallback(() => {
    if (!guessPosition || !currentLocation || !selectedChallenge) return;

    const score = calculateScore(
      guessPosition.x,
      guessPosition.y,
      currentLocation.x,
      currentLocation.y
    );

    setCurrentScore(score);
    setCompletedChallenges((prev) => [
      ...prev.filter((c) => c.date !== selectedChallenge.date),
      {
        date: selectedChallenge.date,
        score,
        guessX: guessPosition.x,
        guessY: guessPosition.y,
      },
    ]);
    setDailyState("result");
  }, [guessPosition, currentLocation, selectedChallenge]);

  const backToSelection = useCallback(() => {
    setDailyState("selecting");
    setSelectedChallenge(null);
    setCurrentLocation(null);
    setGuessPosition(null);
  }, []);

  const isToday = selectedChallenge?.date === todayString;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Selection State */}
        {dailyState === "selecting" && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Daily Challenge
              </div>
              <h1 className="text-4xl font-bold mb-4">Daily Challenge</h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                A new location every day! Play today&apos;s challenge or catch up on
                past ones you might have missed.
              </p>
            </div>

            {/* Today's Challenge */}
            {todayChallenge && (
              <Card className="mb-8 border-2 border-accent overflow-hidden">
                <CardHeader className="bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-accent font-medium">
                        TODAY&apos;S CHALLENGE
                      </p>
                      <CardTitle className="text-2xl mt-1">
                        {formatDate(todayChallenge.date)}
                      </CardTitle>
                    </div>
                    {isCompleted(todayChallenge.date) ? (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Your Score
                        </p>
                        <p className="text-2xl font-bold text-accent">
                          {getCompletedScore(todayChallenge.date)?.toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm font-medium">
                        NEW
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => startChallenge(todayChallenge)}
                  >
                    {isCompleted(todayChallenge.date) ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Play Again
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Play Today&apos;s Challenge
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Past Challenges */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Past Challenges</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dailyChallenges
                  .filter((c) => c.date !== todayString)
                  .slice(0, 30)
                  .map((challenge) => {
                    const completed = isCompleted(challenge.date);
                    const score = getCompletedScore(challenge.date);

                    return (
                      <Card
                        key={challenge.id}
                        className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                          completed ? "bg-muted/30" : ""
                        }`}
                        onClick={() => startChallenge(challenge)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {new Date(challenge.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(challenge.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "long",
                                  }
                                )}
                              </p>
                            </div>
                            {completed ? (
                              <div className="text-right">
                                <p className="font-bold text-primary">
                                  {score?.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  pts
                                </p>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <svg
                                  className="w-4 h-4 text-muted-foreground"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Playing/Result State */}
        {(dailyState === "playing" || dailyState === "result") &&
          currentLocation &&
          selectedChallenge && (
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={backToSelection}
                    className="mb-2"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Back to Challenges
                  </Button>
                  <h1 className="text-2xl font-bold">
                    {isToday ? "Today's Challenge" : formatDate(selectedChallenge.date)}
                  </h1>
                </div>
                {dailyState === "result" && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Your Score</p>
                    <p className="text-3xl font-bold text-primary">
                      {currentScore.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Game Area */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Image */}
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={currentLocation.image}
                        alt="Where is this location?"
                        fill
                        className="object-cover"
                        priority
                      />
                      {dailyState === "result" && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-lg text-muted-foreground mb-2">
                              This was the
                            </p>
                            <h3 className="text-3xl font-bold text-foreground mb-4">
                              {currentLocation.name}
                            </h3>
                            <p className="text-muted-foreground max-w-xs">
                              {currentLocation.description}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Map */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {dailyState === "playing"
                        ? "Click on the map to place your guess"
                        : "Result"}
                    </h2>
                  </div>

                  <SchoolMap
                    onGuess={handleGuess}
                    disabled={dailyState === "result"}
                    guessMarker={guessPosition}
                    actualMarker={
                      dailyState === "result"
                        ? { x: currentLocation.x, y: currentLocation.y }
                        : null
                    }
                    showResult={dailyState === "result"}
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    {dailyState === "playing" && (
                      <Button
                        size="lg"
                        className="flex-1"
                        disabled={!guessPosition}
                        onClick={submitGuess}
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Submit Guess
                      </Button>
                    )}
                    {dailyState === "result" && (
                      <div className="flex gap-4 flex-1">
                        <Button
                          size="lg"
                          variant="outline"
                          className="flex-1"
                          onClick={backToSelection}
                        >
                          More Challenges
                        </Button>
                        <Button size="lg" className="flex-1" asChild>
                          <Link href="/game">Play Classic</Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Score Feedback */}
                  {dailyState === "result" && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            {currentScore >= 4000 ? (
                              <svg
                                className="w-6 h-6 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                              </svg>
                            ) : currentScore >= 2500 ? (
                              <svg
                                className="w-6 h-6 text-primary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-6 h-6 text-muted-foreground"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {currentScore >= 4000
                                ? "Amazing!"
                                : currentScore >= 2500
                                ? "Nice job!"
                                : "Keep practicing!"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {currentScore >= 4000
                                ? "You really know your school!"
                                : currentScore >= 2500
                                ? "You're getting closer!"
                                : "Explore more to improve your score."}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
