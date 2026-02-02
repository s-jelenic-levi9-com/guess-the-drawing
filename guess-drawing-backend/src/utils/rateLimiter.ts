export const createRateLimiter = (max: number, windowMs: number) => {
  let count = 0;
  let resetTime = Date.now() + windowMs;

  return (): boolean => {
    const now = Date.now();
    
    if (now > resetTime) {
      count = 0;
      resetTime = now + windowMs;
    }

    count++;
    return count <= max;
  };
};
