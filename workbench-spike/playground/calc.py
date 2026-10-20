"""Tiny calculator used to test live edit playback."""


def add(a, b):
    return a + b


def mean(xs):
    """Calculate the arithmetic mean of a list of numbers.

    Args:
        xs: A list of numbers

    Returns:
        float: The arithmetic mean of the input list

    Raises:
        ValueError: If the input list is empty
    """
    if not xs:
        raise ValueError("Cannot calculate mean of an empty list")
    return sum(xs) / len(xs)


def median(xs):
    """Calculate the median of a list of numbers.

    Args:
        xs: A list of numbers

    Returns:
        float: The median value

    Raises:
        ValueError: If the input list is empty
    """
    if not xs:
        raise ValueError("Cannot calculate median of an empty list")
    sorted_xs = sorted(xs)
    n = len(sorted_xs)
    if n % 2 == 1:
        return float(sorted_xs[n // 2])
    return (sorted_xs[n // 2 - 1] + sorted_xs[n // 2]) / 2


if __name__ == "__main__":
    numbers = [1, 2, 3, 4, 5]
    print(f"Mean of {numbers}: {mean(numbers)}")
    print(f"Median of {numbers}: {median(numbers)}")
