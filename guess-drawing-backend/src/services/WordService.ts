import { Word } from '../types';

// In-memory word bank
const words: Word[] = [
  // Easy words
  { id: '1', word: 'cat', difficulty: 'easy', category: 'animals' },
  { id: '2', word: 'dog', difficulty: 'easy', category: 'animals' },
  { id: '3', word: 'sun', difficulty: 'easy', category: 'nature' },
  { id: '4', word: 'moon', difficulty: 'easy', category: 'nature' },
  { id: '5', word: 'tree', difficulty: 'easy', category: 'nature' },
  { id: '6', word: 'car', difficulty: 'easy', category: 'vehicles' },
  { id: '7', word: 'house', difficulty: 'easy', category: 'buildings' },
  { id: '8', word: 'book', difficulty: 'easy', category: 'objects' },
  { id: '9', word: 'apple', difficulty: 'easy', category: 'food' },
  { id: '10', word: 'ball', difficulty: 'easy', category: 'objects' },
  { id: '11', word: 'fish', difficulty: 'easy', category: 'animals' },
  { id: '12', word: 'star', difficulty: 'easy', category: 'nature' },
  { id: '13', word: 'flower', difficulty: 'easy', category: 'nature' },
  { id: '14', word: 'bird', difficulty: 'easy', category: 'animals' },
  { id: '15', word: 'pizza', difficulty: 'easy', category: 'food' },
  // Medium words
  { id: '21', word: 'elephant', difficulty: 'medium', category: 'animals' },
  { id: '22', word: 'guitar', difficulty: 'medium', category: 'music' },
  { id: '23', word: 'computer', difficulty: 'medium', category: 'technology' },
  { id: '24', word: 'rainbow', difficulty: 'medium', category: 'nature' },
  { id: '25', word: 'mountain', difficulty: 'medium', category: 'nature' },
  { id: '26', word: 'bicycle', difficulty: 'medium', category: 'vehicles' },
  { id: '27', word: 'butterfly', difficulty: 'medium', category: 'animals' },
  { id: '28', word: 'lighthouse', difficulty: 'medium', category: 'buildings' },
  { id: '29', word: 'umbrella', difficulty: 'medium', category: 'objects' },
  { id: '30', word: 'dolphin', difficulty: 'medium', category: 'animals' },
  // Hard words
  { id: '41', word: 'microscope', difficulty: 'hard', category: 'science' },
  { id: '42', word: 'helicopter', difficulty: 'hard', category: 'vehicles' },
  { id: '43', word: 'skateboard', difficulty: 'hard', category: 'sports' },
  { id: '44', word: 'chandelier', difficulty: 'hard', category: 'objects' },
  { id: '45', word: 'saxophone', difficulty: 'hard', category: 'music' },
];

export class WordService {
  async getRandomWord(difficulty: string = 'mixed'): Promise<Word> {
    let filteredWords: Word[];

    if (difficulty === 'mixed') {
      filteredWords = words;
    } else {
      filteredWords = words.filter(w => w.difficulty === difficulty);
    }

    const randomIndex = Math.floor(Math.random() * filteredWords.length);
    return filteredWords[randomIndex];
  }

  async getWordsByDifficulty(difficulty: string): Promise<Word[]> {
    return words.filter(w => w.difficulty === difficulty);
  }

  async getAllWords(): Promise<Word[]> {
    return words;
  }
}
