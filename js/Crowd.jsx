import { useMemo } from 'react';
import Person from './Person.jsx';
import CrowdInstanced from './CrowdInstanced.jsx';
import { createCrowdPeople, defaultStates } from './crowdData.js';

export default function Crowd({
  count = 24,
  center = [0, 0, 0],
  spread = [4.5, 0, 3.5],
  states = defaultStates,
  instanced = false
}) {
  const people = useMemo(() => createCrowdPeople({ count, center, spread, states }), [count, center, spread, states]);

  if (instanced) {
    return <CrowdInstanced people={people} />;
  }

  return (
    <group>
      {people.map((person, index) => (
        <Person key={index} id={index} {...person} />
      ))}
    </group>
  );
}