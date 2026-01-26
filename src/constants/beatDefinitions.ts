import { BeatTitle, type BeatNumber } from '../types/story';

export interface BeatDefinition {
  number: BeatNumber;
  title: BeatTitle;
  description: string;
  promptHint: string;
}

export const BEAT_DEFINITIONS: BeatDefinition[] = [
  {
    number: 1,
    title: BeatTitle.WhereWeBegin,
    description: "Establish protagonist's world before change",
    promptHint: "Where does the story start? Who is this person before everything changes?"
  },
  {
    number: 2,
    title: BeatTitle.WhatTheyWant,
    description: "Protagonist's initial goal/desire",
    promptHint: "What does your protagonist want? What are they trying to achieve?"
  },
  {
    number: 3,
    title: BeatTitle.TheWorldAroundThem,
    description: "Setting, rules, stakes",
    promptHint: "What's the world around them? What rules, tensions, or obstacles exist?"
  },
  {
    number: 4,
    title: BeatTitle.SomethingGoesWrong,
    description: "Inciting incident, catalyst",
    promptHint: "What goes wrong? What disrupts their world and forces them to act?"
  },
  {
    number: 5,
    title: BeatTitle.AHardChoice,
    description: "Protagonist decides their path",
    promptHint: "What hard choice do they have to make? What path do they decide to take?"
  },
  {
    number: 6,
    title: BeatTitle.CrossingTheLine,
    description: "Point of no return",
    promptHint: "What's the point of no return? What action can't be undone?"
  },
  {
    number: 7,
    title: BeatTitle.ThingsGetMessy,
    description: "Complications, escalation",
    promptHint: "How do things get complicated? What escalates or goes sideways?"
  },
  {
    number: 8,
    title: BeatTitle.ATruthIsRevealed,
    description: "Key information changes everything",
    promptHint: "What truth is revealed? What information changes the stakes?"
  },
  {
    number: 9,
    title: BeatTitle.EverythingStartsToFallApart,
    description: "Momentum toward collapse",
    promptHint: "How does everything start to fall apart? What's collapsing?"
  },
  {
    number: 10,
    title: BeatTitle.TheLowestPoint,
    description: "Dark night of the soul",
    promptHint: "What's the lowest point? When does all seem lost?"
  },
  {
    number: 11,
    title: BeatTitle.BecomingSomeoneNew,
    description: "Transformation, growth",
    promptHint: "How do they transform? What makes them become someone new?"
  },
  {
    number: 12,
    title: BeatTitle.HowItAllEnds,
    description: "Resolution, new equilibrium",
    promptHint: "How does it end? What's the new normal or resolution?"
  },
];

export function getBeatDefinition(beatNumber: BeatNumber): BeatDefinition {
  return BEAT_DEFINITIONS[beatNumber - 1];
}
